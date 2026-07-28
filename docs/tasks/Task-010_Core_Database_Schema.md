# Task-010: Core Database Schema

Status: Complete
Implemented In: 0.4.3

## Objective

Create initial database migrations for core domain tables.

## Context

Required reading: `docs/04_Database_Architecture.md`, `docs/03_Domain_Model.md`.

## Scope

- assets.
- broker_asset_mappings.
- portfolios.
- broker_accounts.
- portfolio_broker_account_links.
- strategies.
- strategy_versions.
- signals.
- risk limits.
- audit records.

## Out of Scope

- Historical price bars.
- Outbox worker implementation.
- Live broker calls.

## Outputs

- Database migration files.
- Schema tests.

## Acceptance Criteria

- Core tables match the documented schema direction.
- Required safety fields are not omitted.
- Sensitive broker account references are designed for masking or encryption.

## Tests Required

- Migration tests.
- Basic repository/persistence tests if repositories are introduced.

## Safety Requirements

- Broker account permission defaults to unverified or blocked.

## Dependencies

- Task-009.
