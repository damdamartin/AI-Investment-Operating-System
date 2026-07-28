create table outbox_events (
  id uuid primary key,
  event_type text not null,
  aggregate_type text not null,
  aggregate_id uuid not null,
  payload jsonb not null,
  idempotency_key text not null unique,
  status text not null default 'PENDING' check (status in ('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED', 'DEAD_LETTER')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  next_attempt_at timestamptz,
  locked_by text,
  locked_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  check (
    (status <> 'PROCESSED' and processed_at is null)
    or (status = 'PROCESSED' and processed_at is not null)
  )
);

create index outbox_events_pending_idx
  on outbox_events (status, next_attempt_at, created_at)
  where status in ('PENDING', 'FAILED');
