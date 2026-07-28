# Task-053: API Usage and Cost Monitor

Status: Complete
Implemented In: 0.4.38
Last Updated: 2026-07-28

## Objective

Track external API usage, failures, latency, rate limits, and Claude cost metadata.

## Context

Required reading: `docs/05_API_Architecture.md`, `docs/06_AI_Architecture.md`, `docs/09_Operation_Deployment.md`.

## Scope

- API call metrics model.
- Provider usage aggregation.
- Claude token and cost metadata.
- Rate limit event tracking.

## Out of Scope

- Billing provider integration.
- Automatic strategy shutdown based solely on cost.

## Outputs

- API usage monitor.
- Tests for aggregation and redaction.

## Acceptance Criteria

- API calls can be summarized by provider and time period.
- Secrets are not included in usage logs.
- Rate limit events are observable.

## Tests Required

- Unit tests for aggregation.
- Redaction tests.

## Safety Requirements

- Logs and metrics must not expose credentials.

## Implementation Notes

- Added `ApiUsageMonitor` for safe external API call logging and aggregation.
- Added provider usage records for Toss Securities, Naver News, and Claude.
- Added provider/time-period summaries for calls, failures, retries, latency, and rate limit events.
- Added Claude token and estimated cost aggregation.
- API usage metadata is redacted before being stored in usage records.
- Billing provider integration and automatic strategy shutdown based solely on cost remain out of scope.

## Dependencies

- Task-013.
- Task-018.
