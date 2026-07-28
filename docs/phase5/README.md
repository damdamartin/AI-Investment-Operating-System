# Phase 5 Read-Only Evidence Plan

Version: 0.5.1
Status: Active
Last Updated: 2026-07-28

## Purpose

Phase 5 collects evidence from real external systems without enabling live trading.

The first target is Toss Securities Open API read-only validation.

## Non-Negotiable Boundary

Phase 5 may verify authentication, account reads, position reads, market data reads, documentation evidence, and sanitized recorded fixtures.

Phase 5 must not place, modify, or cancel real orders.

## Local Secret Handling

API keys must be entered only into a local `.env` file or a secret manager.

Do not paste API keys, client secrets, access tokens, account numbers, or raw API responses into chat, documentation, commits, screenshots, or logs.

The repository provides `.env.example` with placeholder names only.

## Required Toss Evidence

Minimum evidence before read-only integration work is considered ready:

- API terms review evidence
- authentication read evidence
- account snapshot read evidence
- position query read evidence
- market data read evidence

Additional evidence to collect:

- order status query read evidence
- fill query read evidence
- Korean ETF support documentation
- U.S. ETF support documentation
- fractional support documentation
- extended-hours support documentation

## Evidence Rules

Every evidence record must be:

- sanitized
- free of credentials
- free of account numbers unless masked
- free of access tokens
- free of raw request headers
- marked with collection time
- linked to an open question such as OQ-001, OQ-002, OQ-003, or OQ-004

Evidence older than 30 days should be refreshed before it is used for an important decision.

## Read-Only Review Model

The codebase includes `TossReadOnlyEvidencePlan`.

It checks whether the minimum evidence set exists, whether any evidence contains credentials, whether any live write operation appears, and whether evidence is stale.

This model is review-only. It does not call Toss API and does not enable live trading.

## Evidence Recording

The codebase includes `TossReadOnlyEvidenceRecorder`.

It creates a sanitized evidence item from a read-only result summary and payload preview.

Rules:

- raw Toss API responses must not be committed
- raw request headers must not be committed
- access tokens must not be committed
- account numbers must not be committed
- client secrets must not be committed
- evidence containing live write command shapes must be rejected

The recorder produces:

- a review item for `TossReadOnlyEvidencePlan`
- a sanitized preview for local inspection
- safety flags for credentials, account identifiers, and live write operation shapes

If the recorder marks an item as not sanitized, that item must not be used as readiness evidence until the payload is manually cleaned.

## Phase 5 Exit Direction

Phase 5 can move forward only when read-only evidence is collected and open questions are updated with evidence.

Live trading remains blocked until later compliance, broker permission, data, strategy, and operational gates are explicitly resolved.
